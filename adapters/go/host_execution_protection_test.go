package flexdoc

import "testing"

func TestHandlerFailsClosedWithoutHostExecutionProtection(t *testing.T) {
	executor, err := NewHostExecution([]string{"https://api.example.test"})
	if err != nil {
		t.Fatalf("NewHostExecution: %v", err)
	}

	defer func() {
		recovered := recover()
		if recovered == nil {
			t.Fatal("expected Handler to panic without HostExecutionProtected")
		}
		message, ok := recovered.(string)
		if !ok {
			t.Fatalf("panic = %#v, want string", recovered)
		}
		want := "FlexDoc Go host execution requires HostExecutionProtected: true after configuring application auth/middleware; the origin allowlist is not authentication."
		if message != want {
			t.Fatalf("panic = %q, want %q", message, want)
		}
	}()

	_ = Handler(Config{
		TryItHostExecution: true,
		HostExecution:      executor,
	})
}

func TestHandlerAcceptsProtectedHostExecution(t *testing.T) {
	executor, err := NewHostExecution([]string{"https://api.example.test"})
	if err != nil {
		t.Fatalf("NewHostExecution: %v", err)
	}

	if Handler(Config{
		TryItHostExecution:     true,
		HostExecutionProtected: true,
		HostExecution:          executor,
	}) == nil {
		t.Fatal("Handler returned nil")
	}
}

func TestHandlerAllowsUnavailableHostExecutionWithoutProtection(t *testing.T) {
	if Handler(Config{TryItHostExecution: true}) == nil {
		t.Fatal("Handler returned nil")
	}
}
