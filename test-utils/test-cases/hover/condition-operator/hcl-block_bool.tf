---
includes:
  - Boolean matching
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    condition {
      test = "Bo$0ol"
      variable = "aws:SecureTransport"
      values = ["true"]
    }
  }
}
