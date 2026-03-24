---
includes:
  - us-east-1
  - us-west-2
  - eu-west-1
excludes:
  - ":"
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["lambda:InvokeFunction"]
      Resource = [
        "arn:aws:lambda:$0
      ]
    }]
  })
}
