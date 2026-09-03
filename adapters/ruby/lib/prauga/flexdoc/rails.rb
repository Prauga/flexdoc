# frozen_string_literal: true

module Prauga
  module FlexDoc
    module Rails
      module_function

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
