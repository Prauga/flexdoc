# frozen_string_literal: true

module Prauga
  module FlexDoc
    Config = Data.define(
      :path,
      :spec_url,
      :title,
      :theme,
      :try_it_enabled,
      :expand,
      :try_it_default_server,
      :try_it_credentials,
      :try_it_api_client_persistence_key
    ) do
      def initialize(
        path: "/docs",
        spec_url: "/openapi.json",
        title: "API Reference",
        theme: "system",
        try_it_enabled: true,
        expand: nil,
        try_it_default_server: nil,
        try_it_credentials: nil,
        try_it_api_client_persistence_key: nil
      )
        normalized = "/#{path.to_s.gsub(%r{\A/+|/+$}, "")}"
        normalized = "/docs" if normalized == "/"
        raise ArgumentError, "FlexDoc theme must be system, light, or dark" unless %w[system light dark].include?(theme)
        if try_it_credentials && !%w[omit same-origin include].include?(try_it_credentials)
          raise ArgumentError, "FlexDoc Try It credentials must be omit, same-origin, or include"
        end
        unless try_it_api_client_persistence_key.nil? || try_it_api_client_persistence_key == false || try_it_api_client_persistence_key.is_a?(String)
          raise ArgumentError, "FlexDoc API Client persistence key must be a string, false, or nil"
        end

        super(
          path: normalized,
          spec_url: spec_url,
          title: title,
          theme: theme,
          try_it_enabled: !!try_it_enabled,
          expand: expand,
          try_it_default_server: try_it_default_server,
          try_it_credentials: try_it_credentials,
          try_it_api_client_persistence_key: try_it_api_client_persistence_key
        )
      end
    end
  end
end
