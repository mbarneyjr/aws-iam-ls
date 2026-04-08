---
includes:
  - condition key
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    condition {
      test = "StringEquals"
      vari$0able = "s3:prefix"
      values = ["home/"]
    }
  }
}
