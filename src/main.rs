mod api;
mod models;

use axum:: {
    routing::get,
    Router,
};

use tower_http::services::ServeDir;

#[tokio::main]
async fn main() {
    let api = Router::new().route("/events", get(api::get_events));

    let app = Router::new().nest("/api", api).fallback_service(ServeDir::new("web"));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();

    println!("Forsyth Signal running at http://localhost:3000");

    axum::serve(listener, app).await.unwrap();
}