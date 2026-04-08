---
includes:
  - condition operator
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    condition {
      te$0st = "StringEquals"
      variable = "s3:prefix"
      values = ["home/"]
    }
  }
}
