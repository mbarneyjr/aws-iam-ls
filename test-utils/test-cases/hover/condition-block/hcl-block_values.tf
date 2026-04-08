---
includes:
  - values to compare
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    condition {
      test = "StringEquals"
      variable = "s3:prefix"
      val$0ues = ["home/"]
    }
  }
}
