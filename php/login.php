<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    $sql = "SELECT * FROM accounts WHERE username = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();

        $status = $user['status'] ?? 'approved';

        if ($status === 'pending') {
            echo json_encode(["status" => "error", "message" => "Your account is pending approval. Please wait for an admin to approve your account."]);
        } else {
            if (password_verify($password, $user['password'])) {
                echo json_encode([
                    "status" => "success",
                    "message" => "Login successful!",
                    "name" => $user['instructor_name'],
                    "user" => [
                        "id" => $user['id'],
                        "instructor_name" => $user['instructor_name'],
                        "username" => $user['username']
                    ]
                ]);
            } else {
                echo json_encode(["status" => "error", "message" => "Invalid username or password!"]);
            }
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Invalid username or password!"]);
    }
    $stmt->close();
}

$conn->close();
?>
