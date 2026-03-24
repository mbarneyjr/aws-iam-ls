---
exact: true
includes:
  - identifiers
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type = "AWS"
      $0
    }
  }
}
