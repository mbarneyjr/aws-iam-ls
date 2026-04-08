---
includes:
  - "service:action"
  - case-insensitive
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    act$0ions = ["s3:GetObject"]
  }
}
