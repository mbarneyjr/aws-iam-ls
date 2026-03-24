---
exact: true
includes:
  - Sid
  - Action
  - NotAction
  - Resource
  - NotResource
  - Condition
  - Principal
  - NotPrincipal
---
resource "aws_iam_role" "example" {
  name = "example"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      $0
    }]
  })

  tags = {
    Name = "example"
  }
}
