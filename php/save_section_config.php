<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $instructor = $_POST['instructor'] ?? '';
    $section_name = $_POST['section_name'] ?? '';
    $new_section_name = $_POST['new_section_name'] ?? '';
    $max_score = intval($_POST['max_score'] ?? 1000);

    if (empty($instructor)) {
        echo json_encode(["status" => "error", "message" => "instructor required"]);
        exit;
    }

    $name = !empty($new_section_name) ? $new_section_name : $section_name;

    try {
        $check = $conn->prepare("SELECT id FROM section_config WHERE instructor=? AND section_name=?");
        $check->bind_param("ss", $instructor, $section_name);
        $check->execute();
        $existing = $check->get_result()->fetch_assoc();
        $check->close();

        if ($existing) {
            if (!empty($new_section_name) && $new_section_name !== $section_name) {
                $chk2 = $conn->prepare("SELECT id FROM section_config WHERE instructor=? AND section_name=?");
                $chk2->bind_param("ss", $instructor, $new_section_name);
                $chk2->execute();
                if ($chk2->get_result()->num_rows > 0) {
                    echo json_encode(["status" => "error", "message" => "Section name already exists"]);
                    $chk2->close();
                    $conn->close();
                    exit;
                }
                $chk2->close();
                $updGroups = $conn->prepare("UPDATE groups_table SET section=? WHERE instructor=? AND section=?");
                $updGroups->bind_param("sss", $new_section_name, $instructor, $section_name);
                $updGroups->execute();
                $updGroups->close();
                $updRatings = $conn->prepare("UPDATE group_ratings SET section=? WHERE instructor=? AND section=?");
                $updRatings->bind_param("sss", $new_section_name, $instructor, $section_name);
                $updRatings->execute();
                $updRatings->close();
                $upd = $conn->prepare("UPDATE section_config SET section_name=?, max_score=? WHERE instructor=? AND section_name=?");
                $upd->bind_param("siss", $new_section_name, $max_score, $instructor, $section_name);
                $upd->execute();
                $upd->close();
            } else {
                $upd = $conn->prepare("UPDATE section_config SET max_score=? WHERE instructor=? AND section_name=?");
                $upd->bind_param("iss", $max_score, $instructor, $section_name);
                $upd->execute();
                $upd->close();
            }
        } else {
            $ins = $conn->prepare("INSERT INTO section_config (instructor, section_name, max_score) VALUES (?, ?, ?)");
            $ins->bind_param("ssi", $instructor, $name, $max_score);
            $ins->execute();
            $ins->close();
        }

        echo json_encode(["status" => "success", "message" => "Section config saved"]);
    } catch (Exception $e) {
        echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
    }
}
$conn->close();
?>