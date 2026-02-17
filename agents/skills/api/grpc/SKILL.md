---
name: grpc
description: gRPC expertise for building high-performance RPC services. Covers Protocol Buffers, service definitions, streaming, and client/server implementation in multiple languages.
category: api
compatible_with:
  - golang-gin
  - python-fastapi
  - microservices
---

# gRPC High-Performance RPC

## Instructions

1. **Assess the use case**: gRPC excels at microservices, real-time streaming, and polyglot environments.
2. **Follow gRPC conventions**:
   - Define services in .proto files
   - Use Protocol Buffers for serialization
   - Implement proper error handling with status codes
   - Consider streaming patterns
3. **Provide complete examples**: Include proto definitions, server, and client code.
4. **Guide on best practices**: Error handling, deadlines, load balancing.

## Protocol Buffers

### Basic Service Definition

```protobuf
// user.proto
syntax = "proto3";

package user.v1;

option go_package = "github.com/myorg/myapp/gen/user/v1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// User service definition
service UserService {
  // Unary RPC
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);

  // Server streaming
  rpc ListUsers(ListUsersRequest) returns (stream User);

  // Client streaming
  rpc BatchCreateUsers(stream CreateUserRequest) returns (BatchCreateResponse);

  // Bidirectional streaming
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

// Messages
message User {
  string id = 1;
  string email = 2;
  string name = 3;
  Role role = 4;
  google.protobuf.Timestamp created_at = 5;
  google.protobuf.Timestamp updated_at = 6;
}

message GetUserRequest {
  string id = 1;
}

message CreateUserRequest {
  string email = 1;
  string name = 2;
  string password = 3;
  Role role = 4;
}

message UpdateUserRequest {
  string id = 1;
  optional string email = 2;
  optional string name = 3;
}

message DeleteUserRequest {
  string id = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  UserFilter filter = 3;
}

message UserFilter {
  optional Role role = 1;
  optional string search = 2;
}

message BatchCreateResponse {
  int32 created_count = 1;
  repeated string user_ids = 2;
}

message ChatMessage {
  string user_id = 1;
  string content = 2;
  google.protobuf.Timestamp timestamp = 3;
}

enum Role {
  ROLE_UNSPECIFIED = 0;
  ROLE_USER = 1;
  ROLE_ADMIN = 2;
  ROLE_MODERATOR = 3;
}
```

### Field Rules

```protobuf
message Example {
  // Scalar types
  string name = 1;
  int32 age = 2;
  int64 id = 3;
  bool active = 4;
  double price = 5;
  bytes data = 6;

  // Optional (explicit presence)
  optional string nickname = 7;

  // Repeated (arrays)
  repeated string tags = 8;

  // Maps
  map<string, string> metadata = 9;

  // Nested message
  Address address = 10;

  // Oneof (union type)
  oneof contact {
    string phone = 11;
    string email = 12;
  }
}

message Address {
  string street = 1;
  string city = 2;
  string country = 3;
}
```

## Server Implementation

### Go Server

```go
// server/main.go
package main

import (
    "context"
    "log"
    "net"

    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"

    pb "github.com/myorg/myapp/gen/user/v1"
)

type userServer struct {
    pb.UnimplementedUserServiceServer
    db *database
}

func (s *userServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    user, err := s.db.FindUser(req.Id)
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "user not found: %v", err)
    }
    return user, nil
}

func (s *userServer) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
    // Validation
    if req.Email == "" {
        return nil, status.Error(codes.InvalidArgument, "email is required")
    }

    user, err := s.db.CreateUser(req)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to create user: %v", err)
    }
    return user, nil
}

// Server streaming
func (s *userServer) ListUsers(req *pb.ListUsersRequest, stream pb.UserService_ListUsersServer) error {
    users, err := s.db.ListUsers(req.Filter)
    if err != nil {
        return status.Errorf(codes.Internal, "failed to list users: %v", err)
    }

    for _, user := range users {
        if err := stream.Send(user); err != nil {
            return err
        }
    }
    return nil
}

// Bidirectional streaming
func (s *userServer) Chat(stream pb.UserService_ChatServer) error {
    for {
        msg, err := stream.Recv()
        if err == io.EOF {
            return nil
        }
        if err != nil {
            return err
        }

        // Echo back
        response := &pb.ChatMessage{
            UserId:    "server",
            Content:   "Received: " + msg.Content,
            Timestamp: timestamppb.Now(),
        }
        if err := stream.Send(response); err != nil {
            return err
        }
    }
}

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }

    grpcServer := grpc.NewServer(
        grpc.UnaryInterceptor(loggingInterceptor),
    )

    pb.RegisterUserServiceServer(grpcServer, &userServer{db: newDatabase()})

    log.Println("Server listening on :50051")
    if err := grpcServer.Serve(lis); err != nil {
        log.Fatalf("failed to serve: %v", err)
    }
}
```

### Node.js Server

```typescript
// server.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('./user.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const userService: grpc.UntypedServiceImplementation = {
  getUser: async (call, callback) => {
    try {
      const user = await db.findUser(call.request.id);
      if (!user) {
        callback({
          code: grpc.status.NOT_FOUND,
          message: 'User not found',
        });
        return;
      }
      callback(null, user);
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal error',
      });
    }
  },

  listUsers: async (call) => {
    const users = await db.listUsers(call.request.filter);
    for (const user of users) {
      call.write(user);
    }
    call.end();
  },
};

const server = new grpc.Server();
server.addService(proto.user.v1.UserService.service, userService);

server.bindAsync(
  '0.0.0.0:50051',
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Server running on port ${port}`);
  }
);
```

## Client Implementation

### Go Client

```go
// client/main.go
package main

import (
    "context"
    "io"
    "log"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"

    pb "github.com/myorg/myapp/gen/user/v1"
)

func main() {
    conn, err := grpc.Dial(
        "localhost:50051",
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatalf("failed to connect: %v", err)
    }
    defer conn.Close()

    client := pb.NewUserServiceClient(conn)

    // Unary call with deadline
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    user, err := client.GetUser(ctx, &pb.GetUserRequest{Id: "123"})
    if err != nil {
        log.Fatalf("GetUser failed: %v", err)
    }
    log.Printf("User: %v", user)

    // Server streaming
    stream, err := client.ListUsers(ctx, &pb.ListUsersRequest{PageSize: 10})
    if err != nil {
        log.Fatalf("ListUsers failed: %v", err)
    }

    for {
        user, err := stream.Recv()
        if err == io.EOF {
            break
        }
        if err != nil {
            log.Fatalf("stream error: %v", err)
        }
        log.Printf("Received user: %v", user)
    }
}
```

### TypeScript Client

```typescript
// client.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('./user.proto');
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const client = new proto.user.v1.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Unary call
client.getUser({ id: '123' }, (err: any, response: any) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('User:', response);
});

// Server streaming
const stream = client.listUsers({ page_size: 10 });
stream.on('data', (user: any) => {
  console.log('Received user:', user);
});
stream.on('end', () => {
  console.log('Stream ended');
});
stream.on('error', (err: any) => {
  console.error('Stream error:', err);
});

// Promisified client
function getUser(id: string): Promise<User> {
  return new Promise((resolve, reject) => {
    client.getUser({ id }, (err: any, response: any) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}
```

## Error Handling

### Status Codes

| Code | Name | Use Case |
|------|------|----------|
| 0 | OK | Success |
| 1 | CANCELLED | Client cancelled |
| 2 | UNKNOWN | Unknown error |
| 3 | INVALID_ARGUMENT | Bad request |
| 4 | DEADLINE_EXCEEDED | Timeout |
| 5 | NOT_FOUND | Resource not found |
| 6 | ALREADY_EXISTS | Resource exists |
| 7 | PERMISSION_DENIED | Not authorized |
| 8 | RESOURCE_EXHAUSTED | Rate limited |
| 9 | FAILED_PRECONDITION | Invalid state |
| 10 | ABORTED | Conflict |
| 11 | OUT_OF_RANGE | Invalid range |
| 12 | UNIMPLEMENTED | Not implemented |
| 13 | INTERNAL | Server error |
| 14 | UNAVAILABLE | Service unavailable |
| 16 | UNAUTHENTICATED | Not authenticated |

### Error Details

```go
import (
    "google.golang.org/genproto/googleapis/rpc/errdetails"
    "google.golang.org/grpc/status"
)

func validateRequest(req *pb.CreateUserRequest) error {
    var violations []*errdetails.BadRequest_FieldViolation

    if req.Email == "" {
        violations = append(violations, &errdetails.BadRequest_FieldViolation{
            Field:       "email",
            Description: "Email is required",
        })
    }

    if len(violations) > 0 {
        st := status.New(codes.InvalidArgument, "validation failed")
        br := &errdetails.BadRequest{FieldViolations: violations}
        st, _ = st.WithDetails(br)
        return st.Err()
    }

    return nil
}
```

## Interceptors (Middleware)

```go
// Unary interceptor
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    start := time.Now()

    resp, err := handler(ctx, req)

    log.Printf("method=%s duration=%s error=%v",
        info.FullMethod,
        time.Since(start),
        err,
    )

    return resp, err
}

// Auth interceptor
func authInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "no metadata")
    }

    tokens := md.Get("authorization")
    if len(tokens) == 0 {
        return nil, status.Error(codes.Unauthenticated, "no token")
    }

    user, err := validateToken(tokens[0])
    if err != nil {
        return nil, status.Error(codes.Unauthenticated, "invalid token")
    }

    ctx = context.WithValue(ctx, userKey, user)
    return handler(ctx, req)
}

// Chain interceptors
server := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        loggingInterceptor,
        authInterceptor,
    ),
)
```

## Best Practices

- **Use deadlines** - Always set timeouts on client calls
- **Handle streaming errors** - Check for EOF and errors in loops
- **Use interceptors** - For cross-cutting concerns (logging, auth, tracing)
- **Version your APIs** - Include version in package name
- **Document with comments** - Proto comments become documentation
- **Use well-known types** - google.protobuf.Timestamp, Empty, etc.
- **Implement health checks** - Use grpc-health-probe
- **Enable reflection** - For debugging with grpcurl

## References

- gRPC Documentation: https://grpc.io/docs/
- Protocol Buffers: https://protobuf.dev/
- gRPC Status Codes: https://grpc.io/docs/guides/status-codes/
