{
  lib,
  buildNpmPackage,
}:

buildNpmPackage {
  pname = "aws-iam-language-server";
  version = "0.0.0";
  src = ./..;
  npmDepsHash = "sha256-mhFb8dFILuYkAPYQtbTNTuMomIuu8PUK/YFgkw0+TPI=";
  doCheck = true;
  checkPhase = ''
    npm test
  '';
  meta = {
    description = "AWS IAM Policy Language Server";
    mainProgram = "aws-iam-language-server";
    homepage = "https://github.com/mbarneyjr/aws-iam-language-server";
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
