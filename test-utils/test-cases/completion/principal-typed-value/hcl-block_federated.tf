---
includes:
  - "cognito-identity.amazonaws.com"
  - "accounts.google.com"
  - "arn:${Partition}:iam::${Account}:saml-provider/${SamlProviderName}"
excludes:
  - "lambda.amazonaws.com"
  - "*"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "Federated"
      identifiers = ["$0"]
    }
  }
}
