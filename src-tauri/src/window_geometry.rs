//! Window placement uses physical coordinates throughout. CSS dimensions are DIP.

#[derive(Clone, Copy, Debug)]
pub struct WorkArea {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Placement {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub branch_left: bool,
}

pub fn placement(cursor: (i32, i32), area: WorkArea, scale: f64) -> Result<Placement, String> {
    let available_width = area
        .right
        .checked_sub(area.left)
        .filter(|v| *v > 0)
        .ok_or("Área útil do monitor inválida.")?;
    let available_height = area
        .bottom
        .checked_sub(area.top)
        .filter(|v| *v > 0)
        .ok_or("Área útil do monitor inválida.")?;
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    let width = (720.0 * scale).round().clamp(1.0, available_width as f64) as u32;
    let height = (440.0 * scale).round().clamp(1.0, available_height as f64) as u32;
    let logical_width = width as f64 / scale;
    let logical_height = height as f64 / scale;
    let compact = logical_width < 620.0 || logical_height < 380.0;
    let branch_left = cursor.0 as i64 > area.left as i64 + available_width as i64 / 2;
    // CSS contract: 16 DIP padding + half of navigation (352, or 304 below 700).
    // Controls consume 52 DIP below the ring, so its center is 26 DIP above center.
    let navigation_half = if logical_width < 700.0 { 152.0 } else { 176.0 };
    let anchor_x = if compact {
        width as f64 / 2.0
    } else if branch_left {
        width as f64 - (16.0 + navigation_half) * scale
    } else {
        (16.0 + navigation_half) * scale
    };
    let anchor_y = height as f64 / 2.0 - 26.0 * scale;
    let x = (cursor.0 as i64 - anchor_x.round() as i64)
        .clamp(area.left as i64, area.right as i64 - width as i64) as i32;
    let y = (cursor.1 as i64 - anchor_y.round() as i64)
        .clamp(area.top as i64, area.bottom as i64 - height as i64) as i32;
    Ok(Placement {
        x,
        y,
        width,
        height,
        branch_left,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const DESKTOP: WorkArea = WorkArea {
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1040,
    };

    fn assert_inside(p: Placement, area: WorkArea) {
        assert!(p.x >= area.left && p.y >= area.top, "{p:?}");
        assert!(p.x + p.width as i32 <= area.right, "{p:?}");
        assert!(p.y + p.height as i32 <= area.bottom, "{p:?}");
        assert!(p.width > 0 && p.height > 0);
    }

    #[test]
    fn preserves_logical_size_at_supported_scales() {
        for (scale, width, height) in [
            (1.0, 720, 440),
            (1.25, 900, 550),
            (1.5, 1080, 660),
            (2.0, 1440, 880),
        ] {
            let p = placement((960, 520), DESKTOP, scale).unwrap();
            assert_eq!((p.width, p.height), (width, height));
            assert_inside(p, DESKTOP);
        }
    }

    #[test]
    fn anchors_ring_at_cursor_when_room_is_available() {
        let p = placement((600, 500), DESKTOP, 1.0).unwrap();
        assert_eq!((p.x, p.y), (408, 306));
        assert!(!p.branch_left);
        let p = placement((1300, 500), DESKTOP, 1.0).unwrap();
        assert_eq!((p.x, p.y), (772, 306));
        assert!(p.branch_left);
    }

    #[test]
    fn corners_and_taskbar_never_clip_the_window() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            for cursor in [(0, 0), (1919, 0), (0, 1039), (1919, 1039)] {
                assert_inside(placement(cursor, DESKTOP, scale).unwrap(), DESKTOP);
            }
        }
    }

    #[test]
    fn negative_monitor_coordinates_and_top_taskbar_are_respected() {
        let area = WorkArea {
            left: -1920,
            top: -1040,
            right: 0,
            bottom: 0,
        };
        let p = placement((-10, -10), area, 1.5).unwrap();
        assert_eq!((p.x, p.y), (-1080, -660));
        assert!(p.branch_left);
        assert_inside(p, area);
        let area = WorkArea {
            left: 40,
            top: 60,
            right: 1280,
            bottom: 720,
        };
        let p = placement((40, 60), area, 1.25).unwrap();
        assert_eq!((p.x, p.y), (40, 60));
        assert_inside(p, area);
    }

    #[test]
    fn small_work_area_shrinks_real_window_instead_of_overflowing() {
        let area = WorkArea {
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
        };
        let p = placement((400, 300), area, 2.0).unwrap();
        assert_eq!((p.width, p.height), (800, 600));
        assert_eq!((p.x, p.y), (0, 0));
    }

    #[test]
    fn invalid_work_area_is_reported_without_panicking() {
        assert!(placement(
            (0, 0),
            WorkArea {
                left: 10,
                top: 10,
                right: 10,
                bottom: 20
            },
            1.0
        )
        .is_err());
        assert!(placement(
            (0, 0),
            WorkArea {
                left: 10,
                top: 10,
                right: 20,
                bottom: 0
            },
            1.0
        )
        .is_err());
    }

    #[test]
    fn invalid_dpi_uses_safe_scale() {
        for scale in [0.0, -1.0, f64::NAN, f64::INFINITY] {
            let p = placement((600, 500), DESKTOP, scale).unwrap();
            assert_eq!((p.width, p.height), (720, 440));
            assert_inside(p, DESKTOP);
        }
    }
}
