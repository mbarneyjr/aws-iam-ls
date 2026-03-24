---
exact: true
includes:
  - type
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      identifiers = ["*"]
      $0
    }
  }
}
