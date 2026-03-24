---
includes:
  - StringEquals
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "*"
      Condition = {
        "String$0
      }
    }]
  })
}
