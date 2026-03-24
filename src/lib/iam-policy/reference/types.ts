export type Services = Array<{ service: string; url: string }>;

export type GlobalConditionKey = {
  name: string;
  valueType: 'single' | 'multi';
  availability: string;
  description: string;
};

export type RawReference = {
  Name: string;
  Version: string;
  Operations: Array<unknown>;
  Actions: Array<{
    Name: string;
    Annotations: {
      Properties: {
        IsList: boolean;
        IsPermissionManagement: boolean;
        IsTaggingOnly: boolean;
        IsWrite: boolean;
      };
    };
    SupportedBy: {
      'IAM Access Analyzer Policy Generation': boolean;
      'IAM Action Last Accessed': boolean;
    };
    Resources?: Array<{ Name: string }>;
    ActionConditionKeys?: Array<string>;
  }>;
  Resources?: Array<{
    Name: string;
    ARNFormats: Array<string>;
    ConditionKeys?: Array<string>;
  }>;
  ConditionKeys: Array<{
    Name: string;
    Types: Array<string>;
  }>;
};

export type ServiceData = {
  name: string;
  actions: Record<string, Action>;
  resources: Array<{
    name: string;
    arnFormats: Array<string>;
    conditionKeys: Array<string>;
  }>;
  conditionKeys: Record<string, ConditionKey>;
};

export type Action = {
  conditionKeys: Array<string>;
  resources: Array<{ name: string }>;
  description?: string;
  accessLevel?: string;
  resourceTypes?: Array<{ name: string; required: boolean }>;
  dependentActions?: Array<string>;
  permissionOnly?: boolean;
};

export type ConditionKey = {
  types: Array<string>;
  description?: string;
};
