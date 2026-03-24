---
includes:
  - "arn:aws:iam::123456789012:root"
  - "arn:aws:iam::123456789012:role/${RoleName}"
  - "arn:aws:iam::123456789012:user/${UserName}"
  - "arn:aws:iam::123456789012:federated-user/${UserName}"
excludes:
  - "arn:aws:sts::123456789012:assumed-role/${RoleName}/${RoleSessionName}"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::123456789012:$0"]
    }
  }
}
