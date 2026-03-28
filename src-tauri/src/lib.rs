pub mod file_parser;
pub mod llm;
pub mod commands;

use log::info;

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    info!("Starting EzGraph application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::parse_file_cmd,
            commands::generate_drawio_xml_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
