# frozen_string_literal: true

require "cgi"
require "digest"
require "json"

module Prauga
  module FlexDoc
    class Host
      IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

      attr_reader :config, :fingerprint

      def initialize(config = Config.new, assets_dir: nil)
        @config = config
        root = assets_dir || File.expand_path("../../../assets", __dir__)
        @javascript = File.binread(File.join(root, "flexdoc.standalone.js"))
        @css = File.binread(File.join(root, "flexdoc.standalone.css"))
        @fingerprint = Digest::SHA256.hexdigest(@javascript + "\0" + @css)[0, 16]
      end

      def response_for_path(path)
        return documentation if path == config.path || path == "#{config.path}/"
        return renderer_javascript if path == "#{config.path}/__flexdoc/renderer.js"
        return renderer_css if path == "#{config.path}/__flexdoc/renderer.css"

        Response.new(status: 404, content_type: "text/plain; charset=utf-8", body: "Not Found", cache_control: nil)
      end

      def documentation
        try_it = { enabled: config.try_it_enabled }
        try_it[:defaultServer] = config.try_it_default_server unless config.try_it_default_server.nil?
        try_it[:credentials] = config.try_it_credentials unless config.try_it_credentials.nil?
        try_it[:apiClientPersistenceKey] = config.try_it_api_client_persistence_key unless config.try_it_api_client_persistence_key.nil?

        options = {
          contractVersion: "1",
          title: config.title,
          theme: config.theme,
          tryIt: try_it
        }
        options[:expand] = config.expand unless config.expand.nil?
        title = CGI.escapeHTML(config.title.to_s)
        path = CGI.escapeHTML(config.path)
        spec_url = safe_json(config.spec_url)
        options_json = safe_json(options)
        body = <<~HTML.delete("\n")
          <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>#{title}</title><link rel="stylesheet" href="#{path}/__flexdoc/renderer.css?v=#{fingerprint}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__=#{spec_url};window.__FLEXDOC_OPTIONS__=#{options_json};</script><script src="#{path}/__flexdoc/renderer.js?v=#{fingerprint}"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}catch(error){root.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>
        HTML
        Response.new(status: 200, content_type: "text/html; charset=utf-8", body:, cache_control: "no-cache")
      end

      def renderer_javascript
        Response.new(status: 200, content_type: "application/javascript; charset=utf-8", body: @javascript, cache_control: IMMUTABLE_CACHE)
      end

      def renderer_css
        Response.new(status: 200, content_type: "text/css; charset=utf-8", body: @css, cache_control: IMMUTABLE_CACHE)
      end

      private

      def safe_json(value)
        JSON.generate(value)
          .gsub("<", "\\u003c")
          .gsub(">", "\\u003e")
          .gsub("&", "\\u0026")
          .gsub("\u2028", "\\u2028")
          .gsub("\u2029", "\\u2029")
      end
    end
  end
end
