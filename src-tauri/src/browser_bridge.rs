//! A loopback channel authenticated with a per-run token. Only the native host
//! knows that token; web pages cannot use it to request actions. Requests flow
//! from Orbit to the extension, which replies with results, never shell commands.
use crate::browser_identity::EXTENSION_ORIGIN;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::Duration,
};
const MAX_PACKET: usize = 1024 * 1024;

pub fn read_packet(reader: &mut impl Read) -> Result<Vec<u8>, String> {
    let mut header = [0u8; 4];
    reader.read_exact(&mut header).map_err(|e| e.to_string())?;
    let length = u32::from_le_bytes(header) as usize;
    if length == 0 || length > MAX_PACKET {
        return Err("Mensagem do navegador muito grande ou vazia.".into());
    }
    let mut data = vec![0; length];
    reader.read_exact(&mut data).map_err(|e| e.to_string())?;
    Ok(data)
}
pub fn write_packet(writer: &mut impl Write, data: &[u8]) -> Result<(), String> {
    if data.is_empty() || data.len() > MAX_PACKET {
        return Err("Mensagem inválida.".into());
    }
    writer
        .write_all(&(data.len() as u32).to_le_bytes())
        .and_then(|_| writer.write_all(data))
        .and_then(|_| writer.flush())
        .map_err(|e| e.to_string())
}
fn send(writer: &mut impl Write, data: &Value) -> Result<(), String> {
    write_packet(
        writer,
        &serde_json::to_vec(data).map_err(|e| e.to_string())?,
    )
}
fn receive(reader: &mut impl Read) -> Result<Value, String> {
    serde_json::from_slice(&read_packet(reader)?).map_err(|e| e.to_string())
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserEntry {
    pub id: String,
    pub url: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserResult {
    pub id: String,
    pub status: String,
    #[serde(default)]
    pub detail: Option<String>,
}
struct Job {
    entries: Vec<BrowserEntry>,
    reply: mpsc::SyncSender<Result<Vec<BrowserResult>, String>>,
}
struct Client {
    id: String,
    jobs: mpsc::SyncSender<Job>,
}
struct Shared {
    client: Mutex<Option<Client>>,
    stop: AtomicBool,
}
pub struct BrowserBridge {
    shared: Arc<Shared>,
    directory: PathBuf,
}
impl BrowserBridge {
    pub fn start(directory: &Path) -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let token = uuid::Uuid::new_v4().to_string();
        let address = listener.local_addr().map_err(|e| e.to_string())?;
        std::fs::write(
            directory.join("browser-connection.json"),
            json!({"address":address.to_string(),"token":token}).to_string(),
        )
        .map_err(|e| e.to_string())?;
        let shared = Arc::new(Shared {
            client: Mutex::new(None),
            stop: AtomicBool::new(false),
        });
        let server = shared.clone();
        thread::spawn(move || {
            while !server.stop.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                        let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
                        let hello = receive(&mut stream);
                        if !matches!(hello,Ok(ref v) if v["token"]==token && v["origin"]==EXTENSION_ORIGIN)
                        {
                            continue;
                        }
                        let (tx, rx) = mpsc::sync_channel::<Job>(1);
                        let id = uuid::Uuid::new_v4().to_string();
                        let Ok(mut slot) = server.client.lock() else {
                            continue;
                        };
                        if slot.is_some() {
                            let _ = send(
                                &mut stream,
                                &json!({"type":"connectionError","message":"Outro perfil do Brave já está conectado ao Orbit."}),
                            );
                            continue;
                        }
                        if send(&mut stream, &json!({"type":"ready"})).is_err() {
                            continue;
                        }
                        *slot = Some(Client {
                            id: id.clone(),
                            jobs: tx,
                        });
                        drop(slot);
                        let state = server.clone();
                        thread::spawn(move || {
                            let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
                            let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));
                            let mut serial = 0u64;
                            while !state.stop.load(Ordering::Relaxed) {
                                match rx.recv_timeout(Duration::from_secs(2)) {
                                    Ok(job) => {
                                        serial += 1;
                                        let result = (|| {
                                            send(
                                                &mut stream,
                                                &json!({"type":"openUrls","requestId":serial,"entries":job.entries}),
                                            )?;
                                            let reply = receive(&mut stream)?;
                                            if reply["type"] != "results"
                                                || reply["requestId"] != serial
                                            {
                                                return Err("Resposta do Brave inválida.".into());
                                            }
                                            let results: Vec<BrowserResult> =
                                                serde_json::from_value(reply["results"].clone())
                                                    .map_err(|e| e.to_string())?;
                                            if results.len() != job.entries.len()
                                                || !results.iter().zip(&job.entries).all(
                                                    |(r, e)| {
                                                        r.id == e.id
                                                            && ["opened", "alreadyOpen", "error"]
                                                                .contains(&r.status.as_str())
                                                    },
                                                )
                                            {
                                                return Err("Resultado do Brave incompleto.".into());
                                            }
                                            Ok(results)
                                        })();
                                        let failed = result.is_err();
                                        let _ = job.reply.send(result);
                                        if failed {
                                            break;
                                        }
                                    }
                                    Err(mpsc::RecvTimeoutError::Timeout) => {
                                        if send(&mut stream, &json!({"type":"ping"})).is_err()
                                            || !matches!(receive(&mut stream),Ok(v) if v["type"]=="pong")
                                        {
                                            break;
                                        }
                                    }
                                    Err(_) => break,
                                }
                            }
                            if let Ok(mut client) = state.client.lock() {
                                if client.as_ref().is_some_and(|c| c.id == id) {
                                    *client = None;
                                }
                            }
                        });
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(150))
                    }
                    Err(_) => break,
                }
            }
        });
        Ok(Self {
            shared,
            directory: directory.to_owned(),
        })
    }
    pub fn connected(&self) -> bool {
        self.shared.client.lock().is_ok_and(|c| c.is_some())
    }
    pub fn prepared(&self) -> bool {
        self.directory.join("browser-host.json").exists()
    }
    pub fn directory(&self) -> &Path {
        &self.directory
    }
    pub fn open_urls(&self, entries: Vec<BrowserEntry>) -> Result<Vec<BrowserResult>, String> {
        if entries.is_empty() {
            return Ok(Vec::new());
        }
        if entries.len() > 100 {
            return Err("Limite de sites excedido.".into());
        }
        let tx = self
            .shared
            .client
            .lock()
            .map_err(|e| e.to_string())?
            .as_ref()
            .map(|c| c.jobs.clone())
            .ok_or("Conecte a extensão do Brave para abrir os sites sem duplicar abas.")?;
        let (reply, rx) = mpsc::sync_channel(1);
        tx.try_send(Job { entries, reply })
            .map_err(|_| "O Brave está ocupado ou desconectado.".to_string())?;
        rx.recv_timeout(Duration::from_secs(40)).map_err(|_| {
            "O Brave não respondeu. Confira a extensão antes de tentar novamente.".to_string()
        })?
    }
}
impl Drop for BrowserBridge {
    fn drop(&mut self) {
        self.shared.stop.store(true, Ordering::Relaxed);
        if let Ok(mut client) = self.shared.client.lock() {
            *client = None;
        }
        let _ = std::fs::remove_file(self.directory.join("browser-connection.json"));
    }
}
#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use std::net::TcpStream;
    pub struct Fixture {
        pub bridge: BrowserBridge,
    }
    impl Fixture {
        pub fn new() -> Self {
            let directory = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            std::fs::create_dir(&directory).unwrap();
            Self {
                bridge: BrowserBridge::start(&directory).unwrap(),
            }
        }
        pub fn connect(&self, valid: bool) -> TcpStream {
            let config: Value = serde_json::from_slice(
                &std::fs::read(self.bridge.directory().join("browser-connection.json")).unwrap(),
            )
            .unwrap();
            let mut stream = TcpStream::connect(config["address"].as_str().unwrap()).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            send(&mut stream, &json!({"token": if valid { config["token"].clone() } else { json!("invalid") }, "origin":EXTENSION_ORIGIN})).unwrap();
            stream
        }
        pub fn peer(&self) -> TcpStream {
            let mut stream = self.connect(true);
            assert_eq!(receive(&mut stream).unwrap()["type"], "ready");
            let deadline = std::time::Instant::now() + Duration::from_secs(3);
            while !self.bridge.connected() {
                assert!(std::time::Instant::now() < deadline);
                thread::sleep(Duration::from_millis(5));
            }
            stream
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(self.bridge.directory());
        }
    }
    pub fn reply(stream: &mut TcpStream, statuses: &[&str], wrong_id: bool) -> Vec<String> {
        let request = loop {
            let value = receive(stream).unwrap();
            if value["type"] != "ping" {
                break value;
            }
            send(stream, &json!({"type":"pong"})).unwrap();
        };
        assert_eq!(request["type"], "openUrls");
        let entries = request["entries"].as_array().unwrap();
        assert_eq!(entries.len(), statuses.len());
        let results: Vec<_> = entries.iter().zip(statuses).map(|(entry, status)| json!({"id": if wrong_id { json!("wrong") } else { entry["id"].clone() }, "status":status})).collect();
        send(
            stream,
            &json!({"type":"results", "requestId":request["requestId"], "results":results}),
        )
        .unwrap();
        entries
            .iter()
            .map(|entry| entry["id"].as_str().unwrap().to_owned())
            .collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn packets_are_framed_and_bounded() {
        let mut data = Vec::new();
        write_packet(&mut data, b"{\"ok\":true}").unwrap();
        assert_eq!(read_packet(&mut &data[..]).unwrap(), b"{\"ok\":true}");
        assert!(read_packet(&mut &u32::MAX.to_le_bytes()[..]).is_err());
        assert!(read_packet(&mut &[0u8; 4][..]).is_err());
        assert!(read_packet(&mut &[4u8, 0, 0, 0, 1][..]).is_err());
    }
    #[test]
    fn offline_bridge_never_falls_back_to_opening_duplicate_tabs() {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir(&dir).unwrap();
        let bridge = BrowserBridge::start(&dir).unwrap();
        assert!(!bridge.connected());
        assert!(bridge
            .open_urls(vec![BrowserEntry {
                id: "one".into(),
                url: "https://example.com/".into()
            }])
            .is_err());
        drop(bridge);
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn authentication_rejects_unknown_clients_and_second_profiles() {
        let fixture = test_support::Fixture::new();
        assert!(receive(&mut fixture.connect(false)).is_err());
        assert!(!fixture.bridge.connected());
        let _first = fixture.peer();
        assert_eq!(
            receive(&mut fixture.connect(true)).unwrap()["type"],
            "connectionError"
        );
    }
    #[test]
    fn roundtrip_accepts_per_item_results_but_rejects_mismatched_ids() {
        let fixture = test_support::Fixture::new();
        let mut peer = fixture.peer();
        let worker = thread::spawn(move || {
            test_support::reply(&mut peer, &["opened", "alreadyOpen", "error"], false);
            test_support::reply(&mut peer, &["opened"], true);
        });
        let entry = |id: &str| BrowserEntry {
            id: id.into(),
            url: "https://example.com/".into(),
        };
        let replies = fixture
            .bridge
            .open_urls(vec![entry("a"), entry("b"), entry("c")])
            .unwrap();
        assert_eq!(
            replies
                .iter()
                .map(|r| r.status.as_str())
                .collect::<Vec<_>>(),
            vec!["opened", "alreadyOpen", "error"]
        );
        assert!(fixture.bridge.open_urls(vec![entry("a")]).is_err());
        worker.join().unwrap();
    }
}
