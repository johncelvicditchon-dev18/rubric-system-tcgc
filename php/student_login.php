<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = strtoupper(trim($_POST['name'] ?? ''));
    $section = $_POST['section'] ?? '';

    if (empty($name)) {
        echo json_encode(["status" => "error", "message" => "Please enter your name"]);
        exit;
    }
    if (empty($section)) {
        echo json_encode(["status" => "error", "message" => "Please select your section"]);
        exit;
    }

    $sql = "SELECT group_name, instructor, section FROM groups_table WHERE (member1_name=? OR member2_name=? OR member3_name=? OR member4_name=? OR member5_name=?) AND section=? LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssssss", $name, $name, $name, $name, $name, $section);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $group = $result->fetch_assoc();
        $section = $group['section'] ?? '';
        echo json_encode([
            "status" => "success",
            "message" => "Welcome, " . $name . "!",
            "name" => $name,
            "instructor" => $group['instructor'],
            "group" => $group['group_name'],
            "section" => $section,
            "student" => [
                "id" => 0,
                "name" => $name,
                "group" => $group['group_name'],
                "instructor" => $group['instructor'],
                "section" => $section
            ]
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Name not found in the selected section. Please ask your instructor to register you first."]);
    }
    $stmt->close();
}

$conn->close();
?>
