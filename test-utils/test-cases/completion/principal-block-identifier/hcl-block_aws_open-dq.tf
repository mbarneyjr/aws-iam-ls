---
includes:
  - "*"
  - "${Account}"
  - "arn:${Partition}:iam::${Account}:root"
  - "arn:${Partition}:iam::${Account}:role/${RoleName}"
  - "arn:${Partition}:sts::${Account}:assumed-role/${RoleName}/${RoleSessionName}"
  - "arn:${Partition}:iam::${Account}:user/${UserName}"
  - "arn:${Partition}:iam::${Account}:federated-user/${UserName}"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["$0
    }
  }
}
