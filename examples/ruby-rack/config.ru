# frozen_string_literal: true

require "json"
require "prauga/flexdoc"

host = Prauga::FlexDoc::Host.new(
  Prauga::FlexDoc::Config.new(path: "/docs", spec_url: "/openapi.json", title: "Rack FlexDoc Example")
)
docs = Prauga::FlexDoc::RackApp.new(host)

app = lambda do |env|
  case env["PATH_INFO"]
  when "/health"
    [200, { "content-type" => "application/json" }, [JSON.generate(status: "ok")]]
  when "/openapi.json"
    body = JSON.generate(openapi: "3.1.0", info: { title: "Rack FlexDoc Example", version: "1.0.0" }, paths: {})
    [200, { "content-type" => "application/json" }, [body]]
  else
    docs.call(env)
  end
end

run app
