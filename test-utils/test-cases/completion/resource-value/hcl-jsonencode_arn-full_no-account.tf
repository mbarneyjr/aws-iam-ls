---
excludes:
  - "arn:aws:s3:us-east-1::accesspoint/${AccessPointName}"
  - "arn:aws:s3:::${BucketName}"
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = [
        "arn:aws:s3:us-east-1::$0
      ]
    }]
  })
}
