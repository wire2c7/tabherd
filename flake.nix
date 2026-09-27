{
  description = "template-repo";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{
      systems,
      flake-parts,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        inputs.treefmt-nix.flakeModule
      ];
      systems = import systems;

      perSystem =
        {
          config,
          pkgs,
          ...
        }:
        {
          # `nix fmt` / `nix flake check` (checks.treefmt) で使用
          treefmt = {
            projectRootFile = "flake.nix";
            programs = {
              nixfmt.enable = true;
              rumdl-check.enable = true;
              shellcheck.enable = true;
              shfmt = {
                enable = true;
                # フラグ付きで起動されると shfmt は .editorconfig を読まないため、明示的に揃える
                indent_size = 2;
              };
            };
            # direnv の DSL はシェルスクリプトとして解釈できないため除外
            settings.formatter.shellcheck.excludes = [ ".envrc*" ];
            settings.formatter.shfmt.excludes = [ ".envrc*" ];
          };

          devShells.default = pkgs.mkShellNoCC {
            packages = [
              config.treefmt.build.wrapper
              pkgs.actionlint
              pkgs.betterleaks
              pkgs.commitlint
              pkgs.jq
              pkgs.prek
            ];

            shellHook = ''
              # ローカルではGitフックを冪等にインストール（フック種別は .pre-commit-config.yaml の default_install_hook_types）
              if [ -z "''${CI:-}" ] && git rev-parse --git-dir >/dev/null 2>&1; then
                prek install --quiet
              fi
            '';
          };
        };
    };
}
