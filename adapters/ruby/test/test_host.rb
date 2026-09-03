# frozen_string_literal: true

require "minitest/autorun"
require "rack/mock"
require "action_dispatch"
require_relative "../lib/prauga/flexdoc"

class FlexDocHostTest < Minitest::Test
  def setup
    @host = Prauga::FlexDoc::Host.new(
      Prauga::FlexDoc::Config.new(path: "/reference", spec_url: "/openapi.json", title: "Ruby <API>")
    )
  end

  def test_host_serves_docs_and_assets
    docs = @host.response_for_path("/reference")
    assert_equal 200, docs.status
    assert_equal "no-cache", docs.cache_control
    assert_includes docs.body, "Ruby &lt;API&gt;"
    assert_includes docs.body, 'window.__FLEXDOC_SPEC_URL__="/openapi.json"'

    js = @host.renderer_javascript
    assert_equal 200, js.status
    assert_includes js.cache_control, "immutable"
    assert_operator js.body.bytesize, :>, 1000
  end

  def test_rack_app_preserves_mount_prefix
    app = Prauga::FlexDoc::RackApp.new(@host)
    response = Rack::MockRequest.new(app).get("/reference")
    assert_equal 200, response.status

    env = Rack::MockRequest.env_for("/__flexdoc/renderer.css", "SCRIPT_NAME" => "/reference")
    status, headers, body = app.call(env)
    assert_equal 200, status
    assert_includes headers.fetch("cache-control"), "immutable"
    assert_operator body.join.bytesize, :>, 1000
  end

  def test_rails_route_helper_mounts_rack_app
    routes = ActionDispatch::Routing::RouteSet.new
    host = @host
    routes.draw do
      Prauga::FlexDoc::Rails.mount(self, host:, at: "/reference")
    end

    response = Rack::MockRequest.new(routes).get("/reference")
    assert_equal 200, response.status
    assert_includes response.body, "Ruby &lt;API&gt;"

    asset = Rack::MockRequest.new(routes).get("/reference/__flexdoc/renderer.js")
    assert_equal 200, asset.status
    assert_equal @host.renderer_javascript.body, asset.body
  end
end
