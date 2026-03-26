{
  description = "AWS IAM Policy Language Server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem =
        { pkgs, ... }:
        {
          packages.grammars = pkgs.callPackage ./nix/grammars.nix { };
          packages.npm = pkgs.callPackage ./nix/npm.nix { };
          packages.vscode = pkgs.callPackage ./nix/vscode.nix { };
          packages.default = pkgs.callPackage ./nix/npm.nix { };

          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.nodejs
              pkgs.opentofu
            ];
          };
        };
    };
}
