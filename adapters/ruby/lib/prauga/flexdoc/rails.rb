# frozen_string_literal: true

module Prauga
  module FlexDoc
    # Rails routing helpers for mounting {RackApp}.
    module Rails
      module_function

      # Mount FlexDoc beneath a Rails router.
      #
      # @param mapper [#mount] Rails route mapper, typically `self` inside `routes.rb`
      # @param host [Host] configured FlexDoc host
      # @param at [String, nil] mount path; defaults to `host.config.path`
      # @param as [Symbol] Rails mount name
      # @return [Host] the mounted host
      # @raise [ArgumentError] when `at` does not match `host.config.path`
      def mount(mapper, host: Host.new, at: nil, as: :flexdoc)
        mount_path = at || host.config.path
        normalized_mount_path = Config.new(path: mount_path).path
        if normalized_mount_path != host.config.path
          raise ArgumentError,
                "Rails mount path #{normalized_mount_path.inspect} must match FlexDoc host path #{host.config.path.inspect}"
        end

        mapper.mount RackApp.new(host), at: normalized_mount_path, as: as
        host
      end
    end
  end
end
