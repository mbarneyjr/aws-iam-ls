---
includes:
  - "arn:aws:lambda:us-east-1::"
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["lambda:InvokeFunction"]
      Resource = [
        "arn:aws:lambda:us-east-1:$0
      ]
    }]
  })
}
