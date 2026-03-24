---
includes:
  - aws
  - aws-us-gov
  - aws-cn
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = [
        "arn:$0
      ]
    }]
  })
}
