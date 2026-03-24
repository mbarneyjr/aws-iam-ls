---
exact: true
includes:
  - test
  - variable
  - values
---
data "aws_iam_policy_document" "example" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["*"]

    condition {
      $0
    }
  }
}
