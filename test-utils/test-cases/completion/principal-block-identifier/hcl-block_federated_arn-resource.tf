---
includes:
  - "arn:aws:iam::123456789012:oidc-provider/${OidcProviderUrl}"
  - "arn:aws:iam::123456789012:saml-provider/${SamlProviderName}"
excludes:
  - "arn:aws:iam::123456789012:root"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::123456789012:$0"]
    }
  }
}
