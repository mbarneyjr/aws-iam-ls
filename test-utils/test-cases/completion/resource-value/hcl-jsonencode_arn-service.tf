---
includes:
  - s3
  - iam
  - ec2
  - lambda
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = [
        "arn:aws:$0
      ]
    }]
  })
}
