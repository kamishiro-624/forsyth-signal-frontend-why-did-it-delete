use forsyth_signal::api::get_events;
use serde_json::Value;
use vercel_runtime::{
    run,
    service_fn,
    Error,
    Request,
};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

async fn handler(_request: Request) -> Result<Value, Error> {
    let response = get_events().await.map_err(|(status, message)| {std::io::Error::other(format!("{}: {}", status, message))})?;

    Ok(serde_json::to_value(response.0)?)
}