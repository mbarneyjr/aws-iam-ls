---
includes:
  - "arn:aws:sts::123456789012:assumed-role/${RoleName}/${RoleSessionName}"
excludes:
  - "arn:aws:iam::123456789012:root"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:sts::123456789012:$0"]
    }
  }
}
