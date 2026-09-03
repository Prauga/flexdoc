# frozen_string_literal: true

module Prauga
  module FlexDoc
    Config = Data.define(:path, :spec_url, :title, :theme, :try_it_enabled) do
      def initialize(path: "/docs", spec_url: "/openapi.json", title: "API Reference", theme: "system", try_it_enabled: true)
        normalized = "/#{path.to_s.gsub(%r{\A/+|/+$}, "")}"
        normalized = "/docs" if normalized == "/"
        raise ArgumentError, "FlexDoc theme must be system, light, or dark" unless %w[system light dark].include?(theme)

        super(path: normalized, spec_url:, title:, theme:, try_it_enabled: !!try_it_enabled)
      end
    end
  end
end
