<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    if ($id <= 0) {
        echo json_encode(["status" => "error", "message" => "Invalid account ID"]);
        exit;
    }

    $fetch = $conn->prepare("SELECT instructor_name FROM accounts WHERE id=? AND status='pending'");
    $fetch->bind_param("i", $id);
    $fetch->execute();
    $fetch_res = $fetch->get_result();
    if ($fetch_res->num_rows === 0) {
        echo json_encode(["status" => "error", "message" => "Account not found or already approved"]);
        $fetch->close();
        $conn->close();
        exit;
    }
    $account = $fetch_res->fetch_assoc();
    $instructor_name = $account['instructor_name'];
    $fetch->close();

    $delete_groups = $conn->prepare("DELETE FROM groups_table WHERE instructor=?");
    $delete_groups->bind_param("s", $instructor_name);
    $delete_groups->execute();
    $delete_groups->close();

    $delete_ratings = $conn->prepare("DELETE FROM group_ratings WHERE instructor=?");
    $delete_ratings->bind_param("s", $instructor_name);
    $delete_ratings->execute();
    $delete_ratings->close();

    $sql = "DELETE FROM accounts WHERE id=? AND status='pending'";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();

    echo json_encode(["status" => "success", "message" => "Account and all related data deleted successfully!"]);
}
$conn->close();
?>
