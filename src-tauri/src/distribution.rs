const APP_STORE_LANE: &str = "app-store";
const DEFAULT_LANE: &str = "developer";

pub(crate) fn distribution_lane() -> &'static str {
    option_env!("HAZAKURA_DISTRIBUTION_LANE").unwrap_or(DEFAULT_LANE)
}

pub(crate) fn is_app_store_distribution_lane() -> bool {
    is_app_store_distribution_lane_for_lane(Some(distribution_lane()))
}

pub(crate) fn is_app_store_distribution_lane_for_lane(lane: Option<&str>) -> bool {
    lane.unwrap_or(DEFAULT_LANE)
        .eq_ignore_ascii_case(APP_STORE_LANE)
}

pub(crate) fn agent_workbench_allowed_by_distribution() -> bool {
    !is_app_store_distribution_lane()
}

pub(crate) fn ensure_agent_workbench_allowed_by_distribution() -> Result<(), String> {
    ensure_agent_workbench_allowed_for_lane(Some(distribution_lane()))
}

pub(crate) fn ensure_agent_workbench_allowed_for_lane(lane: Option<&str>) -> Result<(), String> {
    if is_app_store_distribution_lane_for_lane(lane) {
        return Err(
            "Agent Workbench is not available in the App Store distribution lane.".to_string(),
        );
    }

    Ok(())
}

pub(crate) fn apple_assist_allowed_by_distribution() -> bool {
    apple_assist_allowed_for_lane(Some(distribution_lane()))
}

pub(crate) fn assist_surface_settings_allowed_by_distribution() -> bool {
    assist_surface_settings_allowed_for_lane(Some(distribution_lane()))
}

pub(crate) fn assist_surface_settings_allowed_for_lane(lane: Option<&str>) -> bool {
    agent_workbench_allowed_for_lane(lane) || apple_assist_allowed_for_lane(lane)
}

pub(crate) fn ensure_apple_assist_allowed_by_distribution() -> Result<(), String> {
    ensure_apple_assist_allowed_for_lane(Some(distribution_lane()))
}

fn agent_workbench_allowed_for_lane(lane: Option<&str>) -> bool {
    !is_app_store_distribution_lane_for_lane(lane)
}

// Hazakura Local Assist is allowed in every lane as an on-device writing
// companion. External CLI Agent remains lane-gated separately above.
fn apple_assist_allowed_for_lane(_lane: Option<&str>) -> bool {
    true
}

pub(crate) fn ensure_apple_assist_allowed_for_lane(_lane: Option<&str>) -> Result<(), String> {
    Ok(())
}
