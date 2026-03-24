---
includes:
  - "Service"
excludes:
  - "AWS"
  - "Federated"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "S$0"
      identifiers = ["*"]
    }
  }
}
