{
  lib,
  buildNpmPackage,
}:

buildNpmPackage {
  pname = "aws-iam-ls";
  version = "0.0.0";
  src = ./..;
  npmDepsHash = "sha256-da2L2jye+vqujCsnxfO3YD/h8tUMBH5wp/VLRyxsOjQ=";
  meta = {
    description = "AWS IAM Policy Language Server";
    mainProgram = "aws-iam-ls";
    homepage = "https://github.com/mbarneyjr/aws-iam-ls";
    license = lib.licenses.mit;
    platforms = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    maintainers = with lib.maintainers; [
      mbarneyjr
    ];
  };
}
