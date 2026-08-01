<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $instructor = $_POST['instructor'] ?? '';
    $group_name = $_POST['group_name'] ?? '';
    $section = $_POST['section'] ?? '';

    if (empty($instructor) || empty($group_name)) {
        echo json_encode(["status" => "error", "message" => "instructor and group_name required"]);
        exit;
    }

    $check = "SELECT id, is_closed FROM groups_table WHERE group_name=? AND instructor=? AND section=?";
    $stmt = $conn->prepare($check);
    $stmt->bind_param("sss", $group_name, $instructor, $section);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $new_status = $row['is_closed'] ? 0 : 1;
        $sql = "UPDATE groups_table SET is_closed=? WHERE group_name=? AND instructor=? AND section=?";
        $stmt2 = $conn->prepare($sql);
        $stmt2->bind_param("isss", $new_status, $group_name, $instructor, $section);
        $stmt2->execute();
        $stmt2->close();

        echo json_encode(["status" => "success", "is_closed" => $new_status, "message" => $new_status ? "Group closed" : "Group opened"]);
    } else {
        $ins = $conn->prepare("INSERT INTO groups_table (group_name, instructor, section, is_closed) VALUES (?, ?, ?, 1)");
        $ins->bind_param("sss", $group_name, $instructor, $section);
        $ins->execute();
        $ins->close();
        echo json_encode(["status" => "success", "is_closed" => 1, "message" => "Group closed"]);
    }
    $stmt->close();
}

$conn->close();
?>
