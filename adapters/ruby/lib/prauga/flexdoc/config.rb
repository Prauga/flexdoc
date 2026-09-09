# frozen_string_literal: true

module Prauga
  module FlexDoc
    # FlexDoc renderer configuration.
    #
    # @!attribute [r] path
    #   Normalized docs mount path.
    # @!attribute [r] spec_url
    #   OpenAPI document URL resolved by the browser bootstrap page.
    # @!attribute [r] title
    #   Page and renderer title.
    # @!attribute [r] theme
    #   Renderer theme preset: `system`, `light`, or `dark`.
    # @!attribute [r] try_it_enabled
    #   Whether the Try It client is enabled.
    # @!attribute [r] expand
    #   Optional expansion preset or section list.
    # @!attribute [r] try_it_default_server
    #   Optional default server URL for Try It requests.
    # @!attribute [r] try_it_credentials
    #   Optional fetch credentials mode: `omit`, `same-origin`, or `include`.
    # @!attribute [r] try_it_api_client_persistence_key
    #   Optional persistence key, or `false` to disable.
    # @!attribute [r] try_it_host_execution
    #   Enables host-execution protocol metadata when a real native executor is attached to the host.
    Config = Data.define(
      :path,
      :spec_url,
      :title,
      :theme,
      :try_it_enabled,
      :expand,
      :try_it_default_server,
      :try_it_credentials,
      :try_it_api_client_persistence_key,
      :try_it_host_execution
    ) do
      # Create a validated configuration.
      #
      # @param path [String] docs mount path
      # @param spec_url [String] OpenAPI document URL
      # @param title [String] page and renderer title
      # @param theme [String] renderer theme preset
      # @param try_it_enabled [Boolean] whether Try It is enabled
      # @param expand [String, Array<String>, nil] optional expansion preset or section list
      # @param try_it_default_server [String, nil] optional default server URL for Try It
      # @param try_it_credentials [String, nil] optional fetch credentials mode
      # @param try_it_api_client_persistence_key [String, false, nil] optional persistence key
      # @param try_it_host_execution [Boolean] expose host execution when the host has a native executor
      def initialize(
        path: "/docs",
        spec_url: "/openapi.json",
        title: "API Reference",
        theme: "system",
        try_it_enabled: true,
        expand: nil,
        try_it_default_server: nil,
        try_it_credentials: nil,
        try_it_api_client_persistence_key: nil,
        try_it_host_execution: false
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
          try_it_api_client_persistence_key: try_it_api_client_persistence_key,
          try_it_host_execution: !!try_it_host_execution
        )
      end
    end
  end
end
