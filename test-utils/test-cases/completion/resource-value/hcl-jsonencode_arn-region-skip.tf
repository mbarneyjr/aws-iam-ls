---
includes:
  - ":"
excludes:
  - us-east-1
  - us-west-2
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["iam:GetRole"]
      Resource = [
        "arn:aws:iam:$0
      ]
    }]
  })
}
