const APP_STORE_LANE: &str = "app-store";
const DEFAULT_LANE: &str = "developer";

pub(crate) fn distribution_lane() -> &'static str {
    option_env!("HAZAKURA_DISTRIBUTION_LANE").unwrap_or(DEFAULT_LANE)
}

pub(crate) fn ensure_agent_workbench_allowed_by_distribution() -> Result<(), String> {
    ensure_agent_workbench_allowed_for_lane(Some(distribution_lane()))
}

pub(crate) fn ensure_agent_workbench_allowed_for_lane(lane: Option<&str>) -> Result<(), String> {
    if lane
        .unwrap_or(DEFAULT_LANE)
        .eq_ignore_ascii_case(APP_STORE_LANE)
    {
        return Err(
            "Agent Workbench is not available in the App Store distribution lane.".to_string(),
        );
    }

    Ok(())
}
