---
includes:
  - s3:ResourceAccount
  - s3:TlsVersion
excludes:
  - ec2:ResourceTag/${TagKey}
---
data "aws_iam_policy_document" "example" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "$0
      values   = ["home/"]
    }
  }
}
