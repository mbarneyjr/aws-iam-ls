---
includes:
  - s3:ResourceAccount
  - s3:TlsVersion
excludes:
  - ec2:ResourceTag/${TagKey}
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "*"
      Condition = {
        StringEquals = {
          $0
        }
      }
    }]
  })
}
