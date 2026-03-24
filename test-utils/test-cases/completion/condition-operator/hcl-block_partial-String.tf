---
includes:
  - StringEquals
---
data "aws_iam_policy_document" "example" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["*"]

    condition {
      test     = "String$0"
      variable = "s3:prefix"
      values   = ["home/"]
    }
  }
}
