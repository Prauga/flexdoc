# frozen_string_literal: true

require "json"
require "prauga/flexdoc"

mode = ENV.fetch("FLEXDOC_BENCH_MODE", "baseline")
port = Integer(ENV.fetch("FLEXDOC_BENCH_PORT", "5810"))
origin = ENV.fetch("FLEXDOC_BENCH_ORIGIN", "http://127.0.0.1:#{port}")

spec = {
  openapi: "3.0.3",
  info: { title: "FlexDoc host-impact benchmark", version: "1.0.0" },
  paths: { "/target" => { get: { responses: { "200" => { description: "ok" } } } } }
}.freeze

flexdoc = nil
if mode != "baseline"
  executor = mode == "host" ? Prauga::FlexDoc::HostExecution.new(allowed_origins: [origin]) : nil
  config = Prauga::FlexDoc::Config.new(
    path: "/docs",
    spec_url: "/openapi.json",
    title: "FlexDoc host-impact benchmark",
    try_it_enabled: true,
    try_it_default_server: origin,
    try_it_host_execution: mode == "host"
  )
  host = Prauga::FlexDoc::Host.new(config, host_execution: executor)
  flexdoc = Prauga::FlexDoc::RackApp.new(host)
end

json = ->(payload) { [200, { "content-type" => "application/json" }, [JSON.generate(payload)]] }

run lambda { |env|
  path = env.fetch("PATH_INFO", "/")
  if flexdoc && (path == "/docs" || path.start_with?("/docs/"))
    flexdoc.call(env)
  else
    case path
    when "/health"
      json.call(ok: true)
    when "/target"
      json.call(ok: true, runtime: "ruby-rack")
    when "/openapi.json"
      json.call(spec)
    else
      [404, { "content-type" => "text/plain" }, ["Not Found"]]
    end
  end
}
